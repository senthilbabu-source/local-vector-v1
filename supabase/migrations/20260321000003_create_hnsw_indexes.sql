-- Sprint 119: HNSW indexes for approximate nearest-neighbor search.
-- Cosine distance (<=>) — standard for normalized text embeddings.
-- m=16, ef_construction=64: Supabase-recommended defaults.
-- Partial indexes (WHERE embedding IS NOT NULL) — skip null rows.

CREATE INDEX IF NOT EXISTS idx_menu_items_embedding
  ON public.menu_items USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hallucinations_embedding
  ON public.ai_hallucinations USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_target_queries_embedding
  ON public.target_queries USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_drafts_embedding
  ON public.content_drafts USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_embedding
  ON public.locations USING hnsw (embedding extensions.vector_cosine_ops)
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
