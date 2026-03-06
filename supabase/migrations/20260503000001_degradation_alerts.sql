-- S22: AI Model Degradation Events
-- Cross-org aggregate table — no org isolation (service-role only + admin read)

CREATE TABLE ai_model_degradation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at timestamptz NOT NULL DEFAULT now(),
  model_provider text NOT NULL,
  affected_org_count int NOT NULL,
  avg_alert_spike numeric(5,2) NOT NULL,
  sigma_above_mean numeric(5,2) NOT NULL,
  is_confirmed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_model_degradation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON ai_model_degradation_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Admin read access for dashboard visibility
CREATE POLICY "authenticated_read" ON ai_model_degradation_events FOR SELECT
  TO authenticated USING (true);
