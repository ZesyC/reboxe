CREATE TABLE ai_triage_reports (
  id uuid PRIMARY KEY,
  case_id text NOT NULL REFERENCES dispute_cases(id),
  evidence_id text NOT NULL REFERENCES dispute_evidences(id),
  evidence_version text NOT NULL,
  evidence_checksum text NOT NULL,
  requested_by uuid NOT NULL REFERENCES profiles(id),
  model_id text NOT NULL,
  model_revision text NOT NULL,
  prompt_version text NOT NULL,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(report->>'recommendation'='ADMIN_REVIEW' AND report->>'financialAction'='NONE'),
  UNIQUE(evidence_id,evidence_version,evidence_checksum,model_id,model_revision,prompt_version)
);
ALTER TABLE ai_triage_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_triage_reports FROM anon,authenticated;
--> statement-breakpoint
CREATE FUNCTION reboxe_guard_ai_report() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AI_REPORT_IMMUTABLE';
END $$;
CREATE TRIGGER ai_report_immutable BEFORE UPDATE ON ai_triage_reports FOR EACH ROW EXECUTE FUNCTION reboxe_guard_ai_report();
