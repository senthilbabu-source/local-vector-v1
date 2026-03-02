-- Sprint 119: SQL RPC functions for vector similarity search.
-- All functions use SECURITY DEFINER + SET search_path = public.
-- Called via supabase.rpc() from application code.
-- Similarity = 1 - cosine_distance = 1 - (embedding <=> query_embedding)

-- ── match_menu_items ──────────────────────────────────────────────────────────
-- Public: no org filter — menu items are public (filtered by menu_id).
-- Used by GET /api/public/menu/search and the MenuSearch component.
-- Threshold 0.65: permissive — "spicy food" should match "Nashville Hot Chicken".
-- JOINs menu_categories to get category name (menu_items only have category_id).
CREATE OR REPLACE FUNCTION public.match_menu_items(
  query_embedding        extensions.vector(1536),
  filter_menu_id         uuid,
  match_count            int     DEFAULT 5,
  similarity_threshold   float   DEFAULT 0.65
)
RETURNS TABLE (
  id          uuid,
  name        text,
  description text,
  price       numeric,
  category    text,
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
    mc.name::text AS category,
    LEAST(1.0, (1 - (mi.embedding <=> query_embedding)))::float AS similarity
  FROM public.menu_items mi
  LEFT JOIN public.menu_categories mc ON mc.id = mi.category_id
  WHERE mi.embedding IS NOT NULL
    AND mi.menu_id = filter_menu_id
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
  query_embedding        extensions.vector(1536),
  filter_org_id          uuid,
  match_count            int     DEFAULT 3,
  similarity_threshold   float   DEFAULT 0.92
)
RETURNS TABLE (
  id                uuid,
  claim_text        text,
  correction_status text,
  similarity        float
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
    h.correction_status::text,
    LEAST(1.0, (1 - (h.embedding <=> query_embedding)))::float AS similarity
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
  query_embedding        extensions.vector(1536),
  filter_location_id     uuid,
  match_count            int     DEFAULT 5,
  similarity_threshold   float   DEFAULT 0.80
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
    LEAST(1.0, (1 - (tq.embedding <=> query_embedding)))::float AS similarity
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
  query_embedding        extensions.vector(1536),
  filter_org_id          uuid,
  match_count            int     DEFAULT 3,
  similarity_threshold   float   DEFAULT 0.85
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
    LEAST(1.0, (1 - (cd.embedding <=> query_embedding)))::float AS similarity
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
