-- Sprint 133: Truth-Grounded RAG Chatbot Widget
-- Adds widget configuration columns to locations table.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS widget_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS widget_settings JSONB DEFAULT NULL;

COMMENT ON COLUMN public.locations.widget_enabled IS
  'Whether the RAG chat widget is active for this location. Sprint 133.';
COMMENT ON COLUMN public.locations.widget_settings IS
  'RAG widget configuration: {color, position, greeting, daily_limit}. Sprint 133.';
