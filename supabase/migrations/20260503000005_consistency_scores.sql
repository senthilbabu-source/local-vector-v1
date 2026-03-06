-- S28: Cross-Platform Consistency Score
CREATE TABLE consistency_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id),
  consistency_score int NOT NULL,
  name_score int NOT NULL DEFAULT 0,
  address_score int NOT NULL DEFAULT 0,
  phone_score int NOT NULL DEFAULT 0,
  hours_score int NOT NULL DEFAULT 0,
  menu_score int NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, location_id, snapshot_date)
);
CREATE INDEX consistency_scores_org_idx ON consistency_scores(org_id, snapshot_date DESC);
ALTER TABLE consistency_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_select" ON consistency_scores FOR SELECT
  USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_all" ON consistency_scores FOR ALL
  TO service_role USING (true) WITH CHECK (true);
