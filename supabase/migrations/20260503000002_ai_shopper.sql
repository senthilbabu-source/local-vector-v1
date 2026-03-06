-- S25: AI Shopper Simulation Runs
CREATE TABLE ai_shopper_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id),
  run_at timestamptz NOT NULL DEFAULT now(),
  model_provider text NOT NULL DEFAULT 'openai',
  scenario_type text NOT NULL,
  conversation_turns jsonb NOT NULL DEFAULT '[]',
  failure_turn int,
  failure_reason text,
  overall_pass boolean,
  credit_cost int NOT NULL DEFAULT 4
);

CREATE INDEX ai_shopper_runs_org_location_idx ON ai_shopper_runs(org_id, location_id, run_at DESC);

ALTER TABLE ai_shopper_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON ai_shopper_runs FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "service_role_all" ON ai_shopper_runs FOR ALL
  TO service_role USING (true) WITH CHECK (true);
