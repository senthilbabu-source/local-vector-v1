-- Sprint B: Settings expansion — new org preferences columns
-- AI model monitoring preferences, score drop threshold, webhook URL

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS monitored_ai_models text[] DEFAULT ARRAY['openai','perplexity','gemini','copilot']::text[];

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS score_drop_threshold integer DEFAULT 10;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS webhook_url text;

COMMENT ON COLUMN public.organizations.monitored_ai_models IS
  'AI models included in SOV and hallucination scans. Sprint B.';

COMMENT ON COLUMN public.organizations.score_drop_threshold IS
  'Reality Score drop threshold for alerts (0 = disabled). Sprint B.';

COMMENT ON COLUMN public.organizations.webhook_url IS
  'External webhook URL for alert notifications (Slack, Zapier). Agency plan only. Sprint B.';
