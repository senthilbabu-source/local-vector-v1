# Sprint 119 — pgvector Integration

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/ai/providers.ts`,
> `app/api/cron/audit/route.ts`, `app/m/[slug]/page.tsx`

---

## 🎯 Objective

Build the **pgvector Integration** — enable the `vector` Postgres extension, add embedding columns to 5 tables, create HNSW indexes, build the embedding pipeline using OpenAI `text-embedding-3-small`, implement 4 SQL RPC match functions, wire up semantic search on the public menu page, and add hallucination + draft deduplication using vector similarity.

**What this sprint answers:** "Are these two queries asking the same thing? Did we already generate content about this? Is this hallucination one we've already flagged?"

**What Sprint 119 delivers:**
- `CREATE EXTENSION vector` migration — enables pgvector in Supabase
- `embedding vector(1536)` columns on: `menu_items`, `ai_hallucinations`, `target_queries`, `content_drafts`, `locations`
- HNSW indexes (cosine distance, m=16, ef_construction=64) on all 5 embedding columns
- 4 SQL RPC match functions: `match_menu_items`, `match_hallucinations`, `match_target_queries`, `match_content_drafts`
- `lib/services/embedding-service.ts` — core pipeline: generate single embedding, batch generate, prepare text per table, backfill rows with null embeddings
- `lib/services/hallucination-dedup.ts` — semantic deduplication: before inserting a new hallucination claim, check if a similar one already exists (threshold 0.92)
- `lib/services/draft-dedup.ts` — before generating a new content draft, check if a semantically similar draft already exists (threshold 0.85)
- `app/api/cron/embed-backfill/route.ts` — nightly cron: backfill rows missing embeddings across all 5 tables in batches of 20
- Semantic menu search wired into `/m/[slug]` page — search box that calls `match_menu_items` RPC
- `GET /api/public/menu/search` — public endpoint for semantic menu search
- SOV dashboard "similar queries" widget — shows queries semantically similar to the selected query

**What this sprint does NOT build:** full MCP tool for semantic menu search (future), location discovery matching (future), query clustering UI (future), embedding-powered hallucination grouping UI (future).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                                     — All rules (56 rules as of Sprint 118)
Read CLAUDE.md                                       — Full implementation inventory
Read lib/ai/providers.ts                             — CRITICAL: existing AI client patterns
Read supabase/prod_schema.sql
  § FIND: menu_items — exact columns (name, description, magic_menu_id, etc.)
  § FIND: ai_hallucinations — exact columns (claim_text, org_id, location_id, status)
  § FIND: target_queries — exact columns (query_text, location_id, query_category)
  § FIND: content_drafts — exact columns (draft_title, target_prompt, org_id, status)
  § FIND: locations — exact columns (business_name, categories, city, org_id)
  § FIND: magic_menus — exact columns (is_published, slug, org_id)
  § FIND: any existing pgvector or vector extension line
  § CHECK: which extensions are currently enabled
Read app/api/cron/audit/route.ts                     — Hallucination insertion point
Read app/m/[slug]/page.tsx                           — Menu page to add search to
Read app/dashboard/share-of-voice/ (entire dir)      — SOV pages for similar queries widget
Read lib/supabase/database.types.ts                 — All current types
Read src/__fixtures__/golden-tenant.ts               — All existing fixtures
Read package.json                                    — Check for openai package version
Read vercel.json                                     — Check existing cron schedule format
```

**Specifically understand before writing code:**

1. **`lib/ai/providers.ts` pattern.** Read the entire file. The embedding model client must be initialized using the SAME pattern as the existing AI provider clients. Do not create a standalone `new OpenAI()` anywhere — use whatever factory/export pattern the file already establishes. The model is `text-embedding-3-small` from OpenAI.

2. **Exact column names before writing SQL.** Before writing ANY migration or service, read the `prod_schema.sql` for the exact column names of all 5 tables. Wrong column names = silent runtime errors that tests won't catch if mocks use the same wrong names.

3. **pgvector is not yet installed.** Confirm by searching `prod_schema.sql` for `vector` or `pgvector`. The first migration must `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public`. On Supabase hosted, this is supported natively. On local dev, `supabase start` includes pgvector in the default image.

4. **HNSW vs IVFFlat.** Use HNSW exclusively (`USING hnsw`). Do not use IVFFlat. HNSW is self-maintaining, faster at query time, and doesn't require periodic REINDEX. The parameters `m=16, ef_construction=64` are Supabase-recommended defaults for text embedding workloads.

5. **Cosine distance operator.** Text embeddings use cosine similarity. In pgvector: `<=>` is the cosine distance operator. Similarity = `1 - (embedding <=> query_embedding)`. Always use `vector_cosine_ops` for HNSW index creation.

6. **Batching is mandatory.** OpenAI's embedding API accepts up to 2048 inputs per request. The backfill cron processes rows in batches of 20 to stay well within limits and avoid timeouts. Never embed more than 20 rows in a single API call in this sprint.

7. **Embeddings are nullable by default.** New rows start with `embedding = NULL`. The backfill cron fills them in. Application code that inserts new rows (new menu item, new hallucination) generates the embedding inline, immediately after the DB insert. The backfill is a safety net for rows that missed inline generation.

8. **RPC functions use `SECURITY DEFINER`.** This allows the functions to access the embedding columns regardless of the caller's RLS context. The `SET search_path = public` is required alongside `SECURITY DEFINER` to prevent search_path injection.

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
supabase/migrations/
  [ts1]_enable_pgvector.sql              — CREATE EXTENSION vector
  [ts2]_add_embedding_columns.sql        — 5 embedding columns
  [ts3]_create_hnsw_indexes.sql          — 5 HNSW indexes
  [ts4]_vector_match_functions.sql       — 4 RPC match functions

lib/services/
  embedding-service.ts                   — Core pipeline
  hallucination-dedup.ts                 — Semantic hallucination dedup
  draft-dedup.ts                         — Semantic draft dedup

app/api/
  cron/embed-backfill/route.ts           — Nightly embedding backfill
  public/menu/search/route.ts            — GET semantic menu search

app/m/[slug]/
  _components/
    MenuSearch.tsx                       — Search box + results (client)

app/dashboard/share-of-voice/
  _components/
    SimilarQueriesWidget.tsx             — Shows semantically similar queries
```

---

### Migration 1: Enable pgvector — `[ts]_enable_pgvector.sql`

```sql
-- Sprint 119: Enable pgvector extension
-- Supabase supports pgvector natively (no custom build needed).
-- Must come before any migration that uses the vector type.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

COMMENT ON EXTENSION vector IS
  'pgvector: vector similarity search for Postgres. Sprint 119. '
  'Used for semantic search on menu items, hallucination dedup, '
  'draft dedup, and target query clustering.';
```

---

### Migration 2: Add Embedding Columns — `[ts]_add_embedding_columns.sql`

```sql
-- Sprint 119: Add embedding vector(1536) columns to 5 tables.
-- text-embedding-3-small produces 1536-dimensional vectors.
-- All columns nullable — rows backfilled by the embed-backfill cron.

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.ai_hallucinations
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.target_queries
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.content_drafts
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Document the source text for each column
COMMENT ON COLUMN public.menu_items.embedding IS
  'text-embedding-3-small (1536d). Source: name || '' '' || coalesce(description, '''')';

COMMENT ON COLUMN public.ai_hallucinations.embedding IS
  'text-embedding-3-small (1536d). Source: claim_text';

COMMENT ON COLUMN public.target_queries.embedding IS
  'text-embedding-3-small (1536d). Source: query_text';

COMMENT ON COLUMN public.content_drafts.embedding IS
  'text-embedding-3-small (1536d). '
  'Source: draft_title || '' '' || coalesce(target_prompt, '''')';

COMMENT ON COLUMN public.locations.embedding IS
  'text-embedding-3-small (1536d). '
  'Source: business_name || '' '' || coalesce(categories, '''') || '' '' || city';
```

**IMPORTANT:** Before writing this migration, verify the exact column names for each table from `prod_schema.sql`. The source text fields listed above (`description`, `claim_text`, `query_text`, `draft_title`, `target_prompt`, `business_name`, `categories`, `city`) must exactly match the actual column names. Update accordingly.

---

### Migration 3: HNSW Indexes — `[ts]_create_hnsw_indexes.sql`

```sql
-- Sprint 119: HNSW indexes for approximate nearest-neighbor search.
-- Cosine distance (<=>) — standard for normalized text embeddings.
-- m=16, ef_construction=64: Supabase-recommended defaults.
-- Index only non-null rows (WHERE embedding IS NOT NULL) — partial index.

CREATE INDEX IF NOT EXISTS idx_menu_items_embedding
  ON public.menu_items USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hallucinations_embedding
  ON public.ai_hallucinations USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_target_queries_embedding
  ON public.target_queries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_drafts_embedding
  ON public.content_drafts USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_embedding
  ON public.locations USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

COMMENT ON INDEX idx_menu_items_embedding IS
  'HNSW cosine index. Sprint 119. Supports match_menu_items() RPC.';
COMMENT ON INDEX idx_hallucinations_embedding IS
  'HNSW cosine index. Sprint 119. Supports match_hallucinations() RPC.';
COMMENT ON INDEX idx_target_queries_embedding IS
  'HNSW cosine index. Sprint 119. Supports match_target_queries() RPC.';
COMMENT ON INDEX idx_content_drafts_embedding IS
  'HNSW cosine index. Sprint 119. Supports match_content_drafts() RPC.';
COMMENT ON INDEX idx_locations_embedding IS
  'HNSW cosine index. Sprint 119. Future: location discovery matching.';
```

---

### Migration 4: RPC Match Functions — `[ts]_vector_match_functions.sql`

```sql
-- Sprint 119: SQL RPC functions for vector similarity search.
-- All functions use SECURITY DEFINER + SET search_path = public.
-- Called via supabase.rpc() from application code.
-- Similarity = 1 - cosine_distance = 1 - (embedding <=> query_embedding)

-- ── match_menu_items ──────────────────────────────────────────────────────────
-- Public: no org filter — menu items are public (filtered by is_published).
-- Used by GET /api/public/menu/search and the MenuSearch component.
-- Threshold 0.65: permissive — "spicy food" should match "Nashville Hot Chicken".
CREATE OR REPLACE FUNCTION public.match_menu_items(
  query_embedding   vector(1536),
  filter_menu_id    uuid,            -- magic_menus.id (scopes to one menu)
  match_count       int     DEFAULT 5,
  similarity_threshold float DEFAULT 0.65
)
RETURNS TABLE (
  id          uuid,
  name        text,
  description text,
  price       numeric,     -- read exact price column type from prod_schema.sql
  category    text,        -- read exact category column type from prod_schema.sql
  similarity  float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mi.id,
    mi.name::text,
    mi.description::text,
    mi.price,
    mi.category::text,
    (1 - (mi.embedding <=> query_embedding))::float AS similarity
  FROM public.menu_items mi
  WHERE mi.embedding IS NOT NULL
    AND mi.magic_menu_id = filter_menu_id
    AND (1 - (mi.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY mi.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── match_hallucinations ──────────────────────────────────────────────────────
-- Checks if a claim is semantically similar to an existing hallucination.
-- Threshold 0.92: very strict — claims must be nearly identical to deduplicate.
-- Scoped to org_id.
CREATE OR REPLACE FUNCTION public.match_hallucinations(
  query_embedding      vector(1536),
  filter_org_id        uuid,
  match_count          int     DEFAULT 3,
  similarity_threshold float   DEFAULT 0.92
)
RETURNS TABLE (
  id          uuid,
  claim_text  text,
  status      text,        -- read exact type from prod_schema.sql
  similarity  float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.claim_text::text,
    h.status::text,
    (1 - (h.embedding <=> query_embedding))::float AS similarity
  FROM public.ai_hallucinations h
  WHERE h.embedding IS NOT NULL
    AND h.org_id = filter_org_id
    AND (1 - (h.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY h.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── match_target_queries ──────────────────────────────────────────────────────
-- Find semantically similar queries for the "similar queries" widget.
-- Threshold 0.80: moderate — groups obviously similar queries.
-- Scoped to location_id.
CREATE OR REPLACE FUNCTION public.match_target_queries(
  query_embedding      vector(1536),
  filter_location_id   uuid,
  match_count          int     DEFAULT 5,
  similarity_threshold float   DEFAULT 0.80
)
RETURNS TABLE (
  id          uuid,
  query_text  text,
  similarity  float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tq.id,
    tq.query_text::text,
    (1 - (tq.embedding <=> query_embedding))::float AS similarity
  FROM public.target_queries tq
  WHERE tq.embedding IS NOT NULL
    AND tq.location_id = filter_location_id
    AND (1 - (tq.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY tq.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── match_content_drafts ──────────────────────────────────────────────────────
-- Find existing drafts similar to a proposed new draft topic.
-- Threshold 0.85: strict enough to catch near-duplicates without false positives.
-- Scoped to org_id.
CREATE OR REPLACE FUNCTION public.match_content_drafts(
  query_embedding      vector(1536),
  filter_org_id        uuid,
  match_count          int     DEFAULT 3,
  similarity_threshold float   DEFAULT 0.85
)
RETURNS TABLE (
  id            uuid,
  draft_title   text,
  target_prompt text,
  status        text,
  similarity    float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cd.id,
    cd.draft_title::text,
    cd.target_prompt::text,
    cd.status::text,
    (1 - (cd.embedding <=> query_embedding))::float AS similarity
  FROM public.content_drafts cd
  WHERE cd.embedding IS NOT NULL
    AND cd.org_id = filter_org_id
    AND (1 - (cd.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY cd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.match_menu_items      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_hallucinations  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_target_queries  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_content_drafts  TO authenticated, service_role;
```

**CRITICAL:** Before writing this migration, verify every column name used in the SELECT clauses against `prod_schema.sql`. If `price` is actually `price_cents`, if `category` is actually `item_category`, etc. — fix those before writing. Mismatched column names will cause runtime errors that won't be caught by TypeScript.

---

### Component 1: Embedding Service — `lib/services/embedding-service.ts`

```typescript
/**
 * Core embedding pipeline. Caller passes the embedding client.
 * Uses text-embedding-3-small (1536 dimensions) from OpenAI.
 *
 * Read lib/ai/providers.ts for how to initialize the embedding model.
 * Export an embeddingClient (or embedModel) from providers.ts if not present.
 *
 * ── prepareTextForTable(table, row) ───────────────────────────────────────────
 * Pure function. Builds the text to embed for a given table row.
 * No API calls. Used by generateEmbedding() and batch functions.
 *
 * table: 'menu_items' | 'ai_hallucinations' | 'target_queries' |
 *        'content_drafts' | 'locations'
 *
 * Text construction (read exact column names from prod_schema.sql):
 *   menu_items:        `${row.name} ${row.description ?? ''}`.trim()
 *   ai_hallucinations: row.claim_text
 *   target_queries:    row.query_text
 *   content_drafts:    `${row.draft_title} ${row.target_prompt ?? ''}`.trim()
 *   locations:         `${row.business_name} ${row.categories ?? ''} ${row.city ?? ''}`.trim()
 *
 * Returns: string (trimmed, never empty — fallback to table name if all fields null)
 *
 * ── generateEmbedding(text) ───────────────────────────────────────────────────
 * Calls OpenAI embedding API for a single text string.
 * Returns: number[] (length 1536)
 *
 * Uses: openai.embeddings.create({ model: 'text-embedding-3-small', input: text })
 * Extracts: response.data[0].embedding
 *
 * Error handling:
 *   If API call fails: throw with message 'embedding_failed: {original message}'
 *   Callers decide whether to retry or skip.
 *
 * ── generateEmbeddingsBatch(texts) ────────────────────────────────────────────
 * Calls OpenAI embedding API for an array of texts in one request.
 * Max batch size: 20 (enforced internally — throws if texts.length > 20).
 * Returns: number[][] (same length as input, in same order)
 *
 * Uses: openai.embeddings.create({ model: 'text-embedding-3-small', input: texts })
 * Extracts: response.data.map(d => d.embedding)
 *
 * ── backfillTable(supabase, table, batchSize=20) ──────────────────────────────
 * Fetches rows WHERE embedding IS NULL, generates embeddings in batches,
 * updates the DB. Returns { processed: number; errors: number }.
 *
 * Flow for each batch:
 * 1. SELECT id + text fields WHERE embedding IS NULL LIMIT batchSize
 * 2. If no rows: return (done)
 * 3. Prepare text for each row via prepareTextForTable()
 * 4. generateEmbeddingsBatch(texts)
 * 5. For each row: UPDATE SET embedding = $vector WHERE id = $id
 *    Use individual updates (not bulk) — simpler error handling
 * 6. On individual update error: log warning, increment errors, continue
 *
 * ── saveEmbeddingForRow(supabase, table, id, embedding) ───────────────────────
 * Saves a single embedding to the DB.
 * UPDATE public.{table} SET embedding = $embedding WHERE id = $id
 * Returns { ok: boolean }
 * Used by inline embedding generation (after INSERT of new row).
 *
 * ── generateAndSaveEmbedding(supabase, table, row) ────────────────────────────
 * Convenience: prepareTextForTable() → generateEmbedding() → saveEmbeddingForRow()
 * Never throws — on error: log warning, return { ok: false }.
 * Used inline after DB inserts. Fire-and-forget safe.
 */
```

---

### Component 2: Hallucination Dedup — `lib/services/hallucination-dedup.ts`

```typescript
/**
 * Semantic deduplication for ai_hallucinations.
 * Called from the audit cron BEFORE inserting a new hallucination claim.
 *
 * ── isDuplicateHallucination(supabase, orgId, claimText) ─────────────────────
 * 1. generateEmbedding(claimText)
 * 2. supabase.rpc('match_hallucinations', {
 *      query_embedding: embedding,
 *      filter_org_id: orgId,
 *      match_count: 1,
 *      similarity_threshold: 0.92,
 *    })
 * 3. If data.length > 0: return { isDuplicate: true; existingId: data[0].id; similarity: data[0].similarity }
 * 4. Else: return { isDuplicate: false }
 *
 * Error handling:
 * - If generateEmbedding() throws: log warning, return { isDuplicate: false }
 *   (fail open — better to insert a possible duplicate than to lose a hallucination)
 * - If rpc() fails: same — return { isDuplicate: false }
 *
 * SIMILARITY THRESHOLD = 0.92 (very strict — near-identical claims only)
 * "This restaurant is permanently closed" vs
 * "The business has permanently shut down" → should be ~0.93 → DUPLICATE
 * "Offers vegan options" vs "Has a vegan menu" → ~0.87 → NOT duplicate
 *
 * ── AUDIT CRON INTEGRATION ────────────────────────────────────────────────────
 * In app/api/cron/audit/route.ts, before inserting a new hallucination:
 *
 * const { isDuplicate } = await isDuplicateHallucination(supabase, orgId, claimText);
 * if (isDuplicate) {
 *   // Skip insert — already tracked
 *   continue; // or equivalent skip logic
 * }
 * // Proceed with insert
 * const { data: newHallucination } = await supabase
 *   .from('ai_hallucinations')
 *   .insert({ claim_text: claimText, org_id: orgId, ... })
 *   .select()
 *   .single();
 * // Generate embedding for the newly inserted row
 * void generateAndSaveEmbedding(supabase, 'ai_hallucinations', newHallucination);
 *
 * Read audit/route.ts carefully before making this integration.
 * Find the exact hallucination insertion pattern and modify minimally.
 */
```

---

### Component 3: Draft Dedup — `lib/services/draft-dedup.ts`

```typescript
/**
 * Semantic deduplication for content_drafts.
 * Called before generating a new draft to avoid near-duplicate content.
 *
 * ── findSimilarDrafts(supabase, orgId, draftTitle, targetPrompt) ──────────────
 * Builds combined text: `${draftTitle} ${targetPrompt ?? ''}`.trim()
 * 1. generateEmbedding(combinedText)
 * 2. supabase.rpc('match_content_drafts', {
 *      query_embedding: embedding,
 *      filter_org_id: orgId,
 *      match_count: 3,
 *      similarity_threshold: 0.85,
 *    })
 * 3. Returns: Array<{ id, draft_title, status, similarity }> (empty if none)
 *
 * Error handling:
 * - If generateEmbedding() throws: return [] (fail open)
 * - If rpc() fails: return []
 *
 * ── hasSimilarDraft(supabase, orgId, draftTitle, targetPrompt) ────────────────
 * Convenience wrapper. Returns boolean.
 * Returns true if findSimilarDrafts().length > 0.
 *
 * SIMILARITY THRESHOLD = 0.85
 * This is intentionally looser than hallucination dedup — for drafts we want
 * to catch near-duplicate topics even with different phrasing.
 */
```

---

### Component 4: Backfill Cron — `app/api/cron/embed-backfill/route.ts`

```typescript
/**
 * Nightly cron: embed all rows missing embeddings across the 5 tables.
 * Protected by CRON_SECRET header (same pattern as other cron routes).
 *
 * POST /api/cron/embed-backfill
 *
 * Flow:
 * For each of the 5 tables (in order):
 *   result = await backfillTable(supabase, tableName, batchSize=20)
 *   Log: `Backfilled {table}: {result.processed} rows, {result.errors} errors`
 *
 * Returns:
 * {
 *   ok: true,
 *   results: {
 *     menu_items:        { processed: N, errors: N },
 *     ai_hallucinations: { processed: N, errors: N },
 *     target_queries:    { processed: N, errors: N },
 *     content_drafts:    { processed: N, errors: N },
 *     locations:         { processed: N, errors: N },
 *   },
 *   duration_ms: number,
 * }
 *
 * Use the service role Supabase client (backfill needs to access all org data).
 * Total runtime should be well under 60s for typical data volumes.
 *
 * Add to vercel.json cron schedule:
 * { "path": "/api/cron/embed-backfill", "schedule": "0 3 * * *" }
 * (3 AM UTC daily — after the SOV cron, not during peak hours)
 *
 * Read vercel.json to understand the existing cron entry format.
 */
```

---

### Component 5: Public Menu Search — `GET /api/public/menu/search/route.ts`

```typescript
/**
 * PUBLIC endpoint. No authentication required.
 * Rate limited by Sprint 118 middleware (anonymous tier: 20 req/min).
 *
 * GET /api/public/menu/search?slug={menuSlug}&q={query}&limit={n}
 *
 * Parameters:
 *   slug:  magic_menus.slug (identifies which menu to search)
 *   q:     natural language search query (required, max 200 chars)
 *   limit: number of results (default 5, max 10)
 *
 * Flow:
 * 1. Validate: q required, slug required → 400 if missing
 * 2. Validate: q.length <= 200 → 400 if over
 * 3. Fetch menu: SELECT id FROM magic_menus WHERE slug = $slug AND is_published = true
 *    If not found: 404
 * 4. generateEmbedding(q)
 *    If embedding fails: 500 with { error: 'search_unavailable' }
 * 5. supabase.rpc('match_menu_items', {
 *      query_embedding: embedding,
 *      filter_menu_id: menu.id,
 *      match_count: limit,
 *      similarity_threshold: 0.65,
 *    })
 * 6. Return { results: MenuSearchResult[]; query: q; count: n }
 *
 * MenuSearchResult: { id, name, description, price, category, similarity }
 *
 * Cache headers: Cache-Control: public, max-age=60, stale-while-revalidate=300
 * (short cache — menu items don't change often, but should reflect updates quickly)
 *
 * Error codes:
 * 400: missing_query | missing_slug | query_too_long
 * 404: menu_not_found
 * 500: search_unavailable
 */
```

---

### Component 6: MenuSearch Component — `app/m/[slug]/_components/MenuSearch.tsx`

```typescript
/**
 * 'use client'
 * Semantic menu search box for the public /m/[slug] page.
 *
 * Props: { menuSlug: string }
 *
 * UI:
 * ┌──────────────────────────────────────────────────────────┐
 * │  🔍  Search the menu...        [Search]                  │
 * └──────────────────────────────────────────────────────────┘
 *
 * Below input: results appear after search
 * Each result:
 * ┌──────────────────────────────────────────────────────────┐
 * │  Spicy Chicken Bao                       $14.00          │
 * │  Crispy fried chicken, gochujang...                      │
 * │  {similarity*100}% match                                 │
 * └──────────────────────────────────────────────────────────┘
 *
 * States:
 *   idle:      Show placeholder text, no results
 *   loading:   Show spinner, disable input
 *   results:   Show result cards
 *   empty:     "No matches found for '{query}'. Try a different search."
 *   error:     "Search unavailable. Browse the full menu below."
 *
 * Behavior:
 * - Search triggers on button click OR Enter key
 * - Min 2 characters before search allowed
 * - Debounce: no — search only on explicit submit
 * - Results appear below the search box, above the full menu list
 * - Clearing the input restores the full menu
 *
 * Fetches: GET /api/public/menu/search?slug={menuSlug}&q={query}
 *
 * data-testid:
 *   "menu-search-input"
 *   "menu-search-btn"
 *   "menu-search-results"
 *   "menu-search-result-{id}"
 *   "menu-search-empty"
 *   "menu-search-error"
 */
```

---

### Component 7: Similar Queries Widget — `app/dashboard/share-of-voice/_components/SimilarQueriesWidget.tsx`

```typescript
/**
 * 'use client'
 * Shows queries semantically similar to the currently selected SOV query.
 * Helps identify query groups for content strategy.
 *
 * Props: {
 *   queryId: string;
 *   queryText: string;
 *   locationId: string;
 * }
 *
 * On mount (and when queryId changes):
 * 1. Fetch embedding for queryText: POST /api/sov/similar-queries
 *    (or embed inline if there's a simpler approach — read CLAUDE.md)
 * 2. Display similar queries from match_target_queries RPC
 *
 * Create a new internal API route for this:
 * POST /api/sov/similar-queries
 * Body: { query_text: string; location_id: string }
 * Auth: org member required
 * Returns: Array<{ id, query_text, similarity }>
 *
 * UI:
 * ┌──────────────────────────────────────────────────┐
 * │  Similar Queries                                 │
 * │  "best hookah bar near me"                       │
 * │  ── 94% similar ───────────────────────────────  │
 * │  "hookah lounge close to me"                     │
 * │  ── 87% similar ───────────────────────────────  │
 * └──────────────────────────────────────────────────┘
 *
 * If no similar queries found: "No similar queries found."
 * If loading: skeleton rows.
 * Threshold: 0.80 (passed to match_target_queries).
 *
 * data-testid:
 *   "similar-queries-widget"
 *   "similar-query-{id}"
 */
```

---

### Component 8: Inline Embedding on Insert — Modify Existing Code

```typescript
/**
 * Wire up inline embedding generation for new rows in 3 locations.
 * In each case: after successful INSERT, call void generateAndSaveEmbedding().
 *
 * 1. app/api/cron/audit/route.ts
 *    After inserting new ai_hallucinations row:
 *      void generateAndSaveEmbedding(supabase, 'ai_hallucinations', newRow);
 *    (only if not a duplicate — see hallucination-dedup.ts integration above)
 *
 * 2. Find where menu items are published/created.
 *    Read CLAUDE.md to find this location.
 *    After INSERT into menu_items:
 *      void generateAndSaveEmbedding(supabase, 'menu_items', newRow);
 *
 * 3. Find where content_drafts are created.
 *    After INSERT into content_drafts:
 *      void generateAndSaveEmbedding(supabase, 'content_drafts', newRow);
 *
 * Pattern for all three:
 * - Fire-and-forget: void fn() — never await
 * - The embedding is generated asynchronously after the response is sent
 * - If it fails, the backfill cron catches it on the next run
 * - Never block user-facing operations for embedding generation
 */
```

---

### Component 9: providers.ts Update — `lib/ai/providers.ts`

```typescript
/**
 * MODIFY lib/ai/providers.ts to export the embedding client.
 *
 * Read the file first to understand the existing pattern.
 * Add an embedding-specific export following the same pattern:
 *
 * export const embeddingModel = openai.embedding('text-embedding-3-small');
 * OR
 * export const EMBEDDING_MODEL = 'text-embedding-3-small' as const;
 * export const EMBEDDING_DIMENSIONS = 1536 as const;
 *
 * The exact pattern depends on what's already there.
 * Do NOT create a new OpenAI client — reuse whatever client is already initialized.
 * Do NOT change how existing AI models (Claude, GPT-4, etc.) are exported.
 */
```

---

### Component 10: Golden Tenant Fixtures

```typescript
// Sprint 119 — pgvector fixtures
import type { MenuSearchResult } from '@/app/api/public/menu/search/route';

// Mock 1536-dim embedding (sparse for test brevity — real embeddings are dense)
// Tests should NOT check embedding values — only behavior
export const MOCK_EMBEDDING_1536: number[] = new Array(1536).fill(0).map(
  (_, i) => (i === 0 ? 0.1 : i === 1 ? 0.2 : 0.0)
);

export const MOCK_MENU_SEARCH_RESULTS: MenuSearchResult[] = [
  {
    id: 'menu-item-001',
    name: 'Spicy Hookah Chicken Wings',
    description: 'Crispy wings tossed in our signature hookah sauce',
    price: 14.00,
    category: 'Small Plates',
    similarity: 0.87,
  },
  {
    id: 'menu-item-002',
    name: 'Indo-Fusion Lamb Chops',
    description: 'Marinated lamb with aromatic Indian spices',
    price: 24.00,
    category: 'Main Course',
    similarity: 0.72,
  },
];

export const MOCK_SIMILAR_QUERIES = [
  {
    id: 'query-002',
    query_text: 'hookah bar near me',
    similarity: 0.94,
  },
  {
    id: 'query-003',
    query_text: 'best shisha lounge Alpharetta',
    similarity: 0.88,
  },
];

export const MOCK_HALLUCINATION_DEDUP_RESULT = {
  isDuplicate: true,
  existingId: 'hallucination-001',
  similarity: 0.95,
};

export const MOCK_BACKFILL_RESULT = {
  ok: true,
  results: {
    menu_items:        { processed: 12, errors: 0 },
    ai_hallucinations: { processed: 5,  errors: 0 },
    target_queries:    { processed: 8,  errors: 0 },
    content_drafts:    { processed: 3,  errors: 0 },
    locations:         { processed: 1,  errors: 0 },
  },
  duration_ms: 4200,
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/embedding-service.test.ts` — 22 tests

```
describe('prepareTextForTable — pure')
  1.  menu_items: concatenates name + description
  2.  menu_items: handles null description (name only)
  3.  ai_hallucinations: returns claim_text directly
  4.  target_queries: returns query_text directly
  5.  content_drafts: concatenates draft_title + target_prompt
  6.  content_drafts: handles null target_prompt
  7.  locations: concatenates business_name + categories + city
  8.  locations: handles null categories and city
  9.  trims whitespace from all results
  10. never returns empty string (fallback to table name)

describe('generateEmbedding — OpenAI mocked')
  11. calls openai.embeddings.create with model='text-embedding-3-small'
  12. returns number[] of length 1536
  13. throws 'embedding_failed:...' on API error

describe('generateEmbeddingsBatch — OpenAI mocked')
  14. throws if input length > 20
  15. sends all texts in single API call
  16. returns array of same length as input, in same order

describe('backfillTable — Supabase + OpenAI mocked')
  17. fetches only rows WHERE embedding IS NULL
  18. processes in batches of batchSize
  19. updates DB for each embedded row
  20. increments errors count on individual update failure (continues)
  21. returns { processed, errors } summary

describe('generateAndSaveEmbedding — Supabase + OpenAI mocked')
  22. returns { ok: false } on error — does NOT throw
```

### Test File 2: `src/__tests__/unit/hallucination-dedup.test.ts` — 8 tests

```
describe('isDuplicateHallucination — Supabase + OpenAI mocked')
  1.  returns { isDuplicate: true, existingId, similarity } when match found
  2.  returns { isDuplicate: false } when no match (empty RPC result)
  3.  calls match_hallucinations RPC with threshold=0.92
  4.  returns { isDuplicate: false } when generateEmbedding throws (fail open)
  5.  returns { isDuplicate: false } when RPC throws (fail open)
  6.  passes orgId to filter_org_id parameter
  7.  passes match_count=1 (only need to know if any duplicate exists)
  8.  does not throw under any error condition
```

### Test File 3: `src/__tests__/unit/draft-dedup.test.ts` — 6 tests

```
describe('findSimilarDrafts — Supabase + OpenAI mocked')
  1.  combines draft_title + target_prompt for embedding
  2.  calls match_content_drafts with threshold=0.85
  3.  returns array of similar drafts
  4.  returns [] on embedding error (fail open)
  5.  returns [] on RPC error

describe('hasSimilarDraft')
  6.  returns true if findSimilarDrafts().length > 0
```

### Test File 4: `src/__tests__/unit/menu-search-route.test.ts` — 10 tests

```
describe('GET /api/public/menu/search')
  1.  400 when q is missing
  2.  400 when slug is missing
  3.  400 when q.length > 200
  4.  404 when menu not found (no matching slug or not published)
  5.  calls match_menu_items RPC with filter_menu_id and similarity_threshold=0.65
  6.  returns { results, query, count } on success
  7.  returns 500 with error='search_unavailable' when embedding fails
  8.  limit param respected (default 5, max 10)
  9.  limit capped at 10 even if param is higher
  10. Cache-Control header is set on response
```

### Test File 5: `src/__tests__/unit/embed-backfill-cron.test.ts` — 6 tests

```
describe('POST /api/cron/embed-backfill')
  1.  401 when CRON_SECRET missing from headers
  2.  calls backfillTable() for all 5 tables
  3.  returns results for each table in response
  4.  returns duration_ms in response
  5.  continues processing remaining tables if one table errors
  6.  uses service role client (not user session)
```

### Test File 6: `src/__tests__/e2e/pgvector.spec.ts` — Playwright — 6 tests

```
1.  Menu search: typing query + submitting shows results
2.  Menu search: empty state shown when no matches
3.  Menu search: error state when API returns 500
4.  Menu search: clearing input restores full menu
5.  Similar queries widget: shows similar queries for selected SOV query
6.  Similar queries widget: "No similar queries found" when none exist
```

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/embedding-service.test.ts      # 22 tests
npx vitest run src/__tests__/unit/hallucination-dedup.test.ts    # 8 tests
npx vitest run src/__tests__/unit/draft-dedup.test.ts            # 6 tests
npx vitest run src/__tests__/unit/menu-search-route.test.ts      # 10 tests
npx vitest run src/__tests__/unit/embed-backfill-cron.test.ts    # 6 tests
npx vitest run                                                    # ALL — zero regressions
npx playwright test src/__tests__/e2e/pgvector.spec.ts           # 6 Playwright tests
npx tsc --noEmit                                                  # 0 type errors
```

**Total: 52 Vitest + 6 Playwright = 58 tests**

---

## 📂 Files to Create/Modify — 25 files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `supabase/migrations/[ts]_enable_pgvector.sql` | **CREATE** | CREATE EXTENSION vector |
| 2 | `supabase/migrations/[ts]_add_embedding_columns.sql` | **CREATE** | 5 embedding columns |
| 3 | `supabase/migrations/[ts]_create_hnsw_indexes.sql` | **CREATE** | 5 HNSW indexes |
| 4 | `supabase/migrations/[ts]_vector_match_functions.sql` | **CREATE** | 4 RPC functions + GRANTs |
| 5 | `lib/services/embedding-service.ts` | **CREATE** | Core pipeline |
| 6 | `lib/services/hallucination-dedup.ts` | **CREATE** | Semantic hallucination dedup |
| 7 | `lib/services/draft-dedup.ts` | **CREATE** | Semantic draft dedup |
| 8 | `app/api/cron/embed-backfill/route.ts` | **CREATE** | Nightly backfill cron |
| 9 | `app/api/public/menu/search/route.ts` | **CREATE** | GET semantic menu search |
| 10 | `app/api/sov/similar-queries/route.ts` | **CREATE** | POST similar queries for widget |
| 11 | `app/m/[slug]/_components/MenuSearch.tsx` | **CREATE** | Search box + results UI |
| 12 | `app/dashboard/share-of-voice/_components/SimilarQueriesWidget.tsx` | **CREATE** | Similar queries panel |
| 13 | `lib/ai/providers.ts` | **MODIFY** | Export embedding model/constants |
| 14 | `app/api/cron/audit/route.ts` | **MODIFY** | Add dedup check + inline embedding |
| 15 | `app/m/[slug]/page.tsx` | **MODIFY** | Add MenuSearch component to page |
| 16 | Find menu item creation code | **MODIFY** | Add inline embedding after INSERT |
| 17 | Find content draft creation code | **MODIFY** | Add inline embedding after INSERT |
| 18 | `vercel.json` | **MODIFY** | Add embed-backfill cron schedule |
| 19 | `supabase/prod_schema.sql` | **MODIFY** | Append pgvector extension + columns + indexes + functions |
| 20 | `lib/supabase/database.types.ts` | **MODIFY** | Add embedding columns to table types |
| 21 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 5 new fixtures |
| 22 | `src/__tests__/unit/embedding-service.test.ts` | **CREATE** | 22 tests |
| 23 | `src/__tests__/unit/hallucination-dedup.test.ts` | **CREATE** | 8 tests |
| 24 | `src/__tests__/unit/draft-dedup.test.ts` | **CREATE** | 6 tests |
| 25 | `src/__tests__/unit/menu-search-route.test.ts` | **CREATE** | 10 tests |

*(embed-backfill + e2e test files bring total to 27 if counted separately)*

---

## 🚫 What NOT to Do

1. **DO NOT hardcode column names** — read them from `prod_schema.sql` first. If `description` is actually `item_description`, the migration and service must use the real name.

2. **DO NOT create a standalone `new OpenAI()` in the embedding service** — use the client pattern already established in `lib/ai/providers.ts`. One OpenAI client for the whole app.

3. **DO NOT use IVFFlat** — use HNSW exclusively (`USING hnsw`). IVFFlat requires periodic REINDEX and manual `lists` tuning. HNSW is strictly better for this workload.

4. **DO NOT await `generateAndSaveEmbedding()` in API response paths** — always `void`. Embedding generation adds ~200ms. User-facing responses must not wait for it.

5. **DO NOT embed more than 20 texts per API call** — enforced in `generateEmbeddingsBatch()` with a throw. The backfill cron uses batchSize=20.

6. **DO NOT block hallucination insertion on dedup failure** — `isDuplicateHallucination()` must fail open (return `{ isDuplicate: false }` on any error). Better to store a duplicate than lose a hallucination.

7. **DO NOT skip the GRANT statements** in the RPC migration — without `GRANT EXECUTE`, the functions are callable only by superusers. The `anon` role needs `match_menu_items` (public menu search). `authenticated` and `service_role` need the others.

8. **DO NOT use `similarity_threshold` below 0.6 for menu search** — lower thresholds produce too many irrelevant results. The configured values (0.65, 0.80, 0.85, 0.92) are calibrated for each use case.

9. **DO NOT add pgvector to `database.types.ts` as a raw `number[]`** — the Supabase client handles the serialization. In TypeScript types, embedding columns are `number[] | null`. Do not use `string` for vector columns.

10. **DO NOT break the existing audit cron logic** when adding hallucination dedup — read the file completely, make the minimum change, preserve all existing behavior.

11. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.

12. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

---

## ✅ Definition of Done

- [ ] 4 migrations in correct timestamp order: extension → columns → indexes → functions
- [ ] `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public` present
- [ ] 5 HNSW indexes with `vector_cosine_ops`, `m=16`, `ef_construction=64`, partial (`WHERE embedding IS NOT NULL`)
- [ ] 4 RPC functions with `SECURITY DEFINER`, `SET search_path = public`, correct GRANT statements
- [ ] `embedding-service.ts` — prepareTextForTable() pure (10 cases), generateEmbedding(), generateEmbeddingsBatch() (enforces ≤20), backfillTable(), saveEmbeddingForRow(), generateAndSaveEmbedding() (never throws)
- [ ] `hallucination-dedup.ts` — isDuplicateHallucination() with threshold=0.92, fail open on all errors
- [ ] `draft-dedup.ts` — findSimilarDrafts() with threshold=0.85, hasSimilarDraft(), fail open
- [ ] `embed-backfill` cron — CRON_SECRET auth, all 5 tables, service role client, duration_ms in response
- [ ] `GET /api/public/menu/search` — public, slug+q params, threshold=0.65, Cache-Control header
- [ ] `POST /api/sov/similar-queries` — auth'd, threshold=0.80, returns sorted by similarity
- [ ] `MenuSearch.tsx` — 5 states (idle/loading/results/empty/error), submit on button or Enter
- [ ] `SimilarQueriesWidget.tsx` — fetches on queryId change, skeleton loading, empty state
- [ ] `app/m/[slug]/page.tsx` MODIFIED — MenuSearch added above menu list
- [ ] `audit/route.ts` MODIFIED — dedup check before insert, void embedding after insert
- [ ] Menu item + content draft creation code MODIFIED — void embedding after INSERT
- [ ] `lib/ai/providers.ts` MODIFIED — embedding model/constants exported
- [ ] `vercel.json` MODIFIED — embed-backfill at "0 3 * * *"
- [ ] prod_schema.sql, database.types.ts updated
- [ ] golden-tenant.ts: 5 new fixtures
- [ ] **52 Vitest + 6 Playwright = 58 tests passing**
- [ ] `npx vitest run` — ALL tests, zero regressions
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 57 written
- [ ] roadmap.md Sprint 119 marked ✅

---

## ⚠️ Edge Cases

1. **pgvector not available in local dev** — Supabase's local Docker image includes pgvector by default since v1.0. If `supabase start` is on an older version, `CREATE EXTENSION vector` will fail. Add a note to the DEVLOG: run `supabase update` if the migration fails locally.

2. **Embedding column in `database.types.ts`** — Supabase's type generator doesn't know about pgvector. After adding the migration, manually add `embedding: number[] | null` to the relevant table types in `database.types.ts`. Do not wait for auto-generation.

3. **HNSW index build time on large tables** — HNSW indexes build synchronously during migration. For the golden tenant seed data (small), this is fast (<1s). For production tables with thousands of rows and `embedding IS NOT NULL` being sparse initially (most null), the index builds on zero or few rows — also fast. Document in DEVLOG: index build time scales with embedded rows, not total rows.

4. **Similarity score of `1 - (embedding <=> query_embedding)` can exceed 1.0 for identical vectors** — due to floating point. Always clamp: `LEAST(1.0, 1 - (embedding <=> query_embedding))`. Add this to the RPC functions.

5. **OpenAI embedding API rate limits** — `text-embedding-3-small` has a generous rate limit (1M tokens/min on most tiers). At 20 texts × ~50 tokens avg = 1000 tokens per batch, the backfill cron is well within limits. No rate limit handling needed for MVP.

6. **`match_menu_items` called with no embedded menu items** — the RPC returns an empty array (WHERE embedding IS NOT NULL filters them all out). The MenuSearch shows the empty state. The backfill cron will embed them overnight. Document in DEVLOG: "Menu search requires embed-backfill to run first after adding menu items."

7. **Inline embedding is fire-and-forget** — if the server crashes after INSERT but before the void embedding call completes, the row has no embedding. The backfill cron is the safety net. This is by design.

---

## 🔮 AI_RULES Update (Add Rule 57)

```markdown
## 57. 🧮 pgvector in `lib/services/` (Sprint 119)

* **4 migration files, in order:** extension → columns → indexes → functions.
  HNSW only (never IVFFlat). Cosine ops. m=16, ef_construction=64.
  Partial indexes (WHERE embedding IS NOT NULL).
* **Similarity = 1 - (embedding <=> query_embedding).** Clamp to 1.0.
  Thresholds: menu=0.65, queries=0.80, drafts=0.85, hallucinations=0.92.
* **generateAndSaveEmbedding() never throws.** Always void in INSERT paths.
  Backfill cron is the safety net for missed embeddings.
* **Dedup services fail open.** isDuplicateHallucination() returns
  { isDuplicate: false } on any error. Never block insertion on dedup failure.
* **Batch max = 20.** enforced with throw in generateEmbeddingsBatch().
  Backfill cron uses batchSize=20.
* **GRANT EXECUTE** required on all 4 RPC functions. anon for match_menu_items,
  authenticated + service_role for the other three.
* **embedding columns are number[] | null in TypeScript.** Add manually to
  database.types.ts — Supabase's type generator doesn't know pgvector.
* **Use providers.ts client.** Never create standalone new OpenAI() for embeddings.
```

---

## 🗺️ What Comes Next

**Sprint 120 — AI Preview Streaming:** Server-Sent Events (SSE) for streaming AI-generated content previews in the content draft editor, streaming SOV query simulation in the dashboard, and a reusable `useStreamingResponse()` hook that handles SSE lifecycle, error recovery, and cancellation.
