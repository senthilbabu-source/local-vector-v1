-- Sprint 119: Enable pgvector extension
-- Supabase supports pgvector natively (no custom build needed).
-- Must come before any migration that uses the vector type.
-- On local dev, `supabase start` includes pgvector in the default image.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

COMMENT ON EXTENSION vector IS
  'pgvector: vector similarity search for Postgres. Sprint 119. '
  'Used for semantic search on menu items, hallucination dedup, '
  'draft dedup, and target query clustering.';
